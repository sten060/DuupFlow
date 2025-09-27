// src/lib/ffmpeg.ts
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

// On exige que ffmpeg-static ait bien résolu un binaire local
if (!ffmpegPath) {
  throw new Error("ffmpeg-static n'a pas retourné de chemin binaire");
}

// On injecte ce binaire dans fluent-ffmpeg (et dispo via process si besoin)
ffmpeg.setFfmpegPath(ffmpegPath);
process.env.FFMPEG_PATH = ffmpegPath as string;

export const FFMPEG_PATH = ffmpegPath as string;
export default ffmpeg;