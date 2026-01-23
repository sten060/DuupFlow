// src/lib/ffmpeg.ts
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

// Récupère le chemin du binaire ffmpeg
const ffmpegPath = ffmpegInstaller.path;

// Vérifie que ffmpeg-installer ait bien trouvé un binaire
if (!ffmpegPath) {
  throw new Error("@ffmpeg-installer/ffmpeg n'a pas retourné de chemin binaire");
}

// On injecte ce binaire dans fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

process.env.FFMPEG_PATH = ffmpegPath;

export const FFMPEG_PATH = ffmpegPath;
export default ffmpeg;