// presets.js
module.exports = {
  platforms: {
    "instagram_feed": {
      display: "Instagram (Feed)",
      description: "Square or vertical for feed. Use 1080p for high quality.",
      recommended: { width: 1080, height: 1080, fps: 30, video_bitrate_kbps: 5000, audio_bitrate_kbps: 128, container: "mp4" }
    },
    "instagram_reel": {
      display: "Instagram Reels",
      description: "Vertical 9:16 videos, 1080x1920 recommended.",
      recommended: { width: 1080, height: 1920, fps: 30, video_bitrate_kbps: 8000, audio_bitrate_kbps: 128, container: "mp4" }
    },
    "tiktok": {
      display: "TikTok",
      description: "Vertical 9:16 — 1080x1920 is standard.",
      recommended: { width: 1080, height: 1920, fps: 30, video_bitrate_kbps: 8000, audio_bitrate_kbps: 128, container: "mp4" }
    },
    "facebook_video": {
      display: "Facebook Video",
      description: "16:9 or 4:5; 1080p recommended.",
      recommended: { width: 1920, height: 1080, fps: 30, video_bitrate_kbps: 8000, audio_bitrate_kbps: 128, container: "mp4" }
    },
    "youtube": {
      display: "YouTube",
      description: "Landscape 16:9. 1080p for most, 2160p for higher if uploaded by creator.",
      recommended: { width: 1920, height: 1080, fps: 30, video_bitrate_kbps: 12000, audio_bitrate_kbps: 192, container: "mp4" }
    },
    "twitter": {
      display: "Twitter (X)",
      description: "Max 1920x1200, 60s/120s limits apply.",
      recommended: { width: 1280, height: 720, fps: 30, video_bitrate_kbps: 5000, audio_bitrate_kbps: 128, container: "mp4" }
    },
    "custom": {
      display: "Custom",
      description: "Pick your own resolution, fps and bitrate.",
      recommended: { width: 1280, height: 720, fps: 30, video_bitrate_kbps: 5000, audio_bitrate_kbps: 128, container: "mp4" }
    }
  }
};
