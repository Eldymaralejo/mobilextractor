// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid').v4;
const presets = require('./presets');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const mime = require('mime-types');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// multer config
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const id = uuid();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } }); // up to ~1GB (adjust as needed)

// provide presets to frontend
app.get('/api/presets', (req, res) => {
  res.json(presets.platforms);
});

// upload endpoint; returns jobId
app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const jobId = uuid();
  // store mapping file for later processing
  const job = {
    id: jobId,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
    path: req.file.path
  };
  // persist job metadata (in-memory simple approach; for production use DB)
  jobs[jobId] = job;
  res.json({ jobId, originalName: job.originalName, mime: job.mime });
});

const jobs = {}; // jobId -> metadata

// start processing route: client provides jobId and chosen target (platform/custom) and options
app.post('/api/process', async (req, res) => {
  try {
    const { jobId, targetPlatform, custom } = req.body;
    if (!jobId || !jobs[jobId]) return res.status(400).json({ error: 'Invalid jobId' });
    const job = jobs[jobId];
    // determine target config
    let config = presets.platforms[targetPlatform]?.recommended;
    if (!config) config = presets.platforms.custom.recommended;
    if (custom && typeof custom === 'object') {
      config = { ...config, ...custom };
    }
    // create output name
    const outExt = config.container || 'mp4';
    const outName = `${path.parse(job.filename).name}_${targetPlatform || 'custom'}.${outExt}`;
    const outPath = path.join(OUT_DIR, outName);

    // start processing:
    // - if image mime -> use sharp to resize & compress
    // - else assume video -> use ffmpeg transcode
    if (job.mime.startsWith('image/')) {
      // image processing
      const img = sharp(job.path);
      const width = config.width;
      const height = config.height;
      // preserve aspect: fit inside box
      await img
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .toFormat('jpeg', { quality: Math.min(90, Math.round((config.video_bitrate_kbps || 2000) / 1000 * 80)) })
        .toFile(outPath);
      // emit done via socket (server pushes to all but better: to specific client)
      io.to(req.body.socketId).emit('processing_done', { jobId, url: `/download/${outName}`, outName });
      return res.json({ jobId, url: `/download/${outName}` });
    } else {
      // video processing via ffmpeg
      const inputPath = job.path;
      const targetWidth = config.width;
      const targetHeight = config.height;
      const fps = config.fps || 30;
      const videoBitrate = `${config.video_bitrate_kbps || 5000}k`;
      const audioBitrate = `${config.audio_bitrate_kbps || 128}k`;

      // Build ffmpeg command
      const proc = ffmpeg(inputPath)
        .videoCodec('libx264')
        .size(`${targetWidth}x${targetHeight}`)
        .fps(fps)
        .videoBitrate(videoBitrate)
        .audioBitrate(audioBitrate)
        .outputOptions([
          '-preset veryfast',
          '-movflags +faststart',
          '-pix_fmt yuv420p'
        ])
        .on('start', commandLine => {
          io.to(req.body.socketId).emit('processing_started', { jobId, commandLine });
        })
        .on('progress', progress => {
          // progress.percent sometimes missing; use frames/time
          io.to(req.body.socketId).emit('processing_progress', { jobId, progress });
        })
        .on('error', (err, stdout, stderr) => {
          console.error('ffmpeg error', err);
          io.to(req.body.socketId).emit('processing_error', { jobId, message: err.message });
        })
        .on('end', () => {
          io.to(req.body.socketId).emit('processing_done', { jobId, url: `/download/${outName}`, outName });
        })
        .save(outPath);

      return res.json({ jobId, message: 'processing_started' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// simple download route
app.get('/download/:filename', (req, res) => {
  const file = path.join(OUT_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.download(file);
});

// cleanup endpoint (optional)
app.post('/api/cleanup', (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !jobs[jobId]) return res.status(400).json({ error: 'Invalid jobId' });
  const job = jobs[jobId];
  try {
    if (fs.existsSync(job.path)) fs.unlinkSync(job.path);
    // remove output(s) created
    const base = path.parse(job.filename).name;
    const outs = fs.readdirSync(OUT_DIR).filter(f => f.includes(base));
    outs.forEach(f => fs.unlinkSync(path.join(OUT_DIR, f)));
    delete jobs[jobId];
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// socket.io connection (used to send progress to client)
io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('register', () => {
    // client can use socket.id to receive events
    socket.emit('registered', { socketId: socket.id });
  });
  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
