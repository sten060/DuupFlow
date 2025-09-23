// src/lib/ffmpeg.ts
// Petit wrapper serveur pour configurer fluent-ffmpeg avec le binaire de ffmpeg-static

import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

// Sécurité : s'assurer qu'on a bien un chemin binaire
if (!ffmpegPath) {
  throw new Error(
    "ffmpeg-static n'a pas renvoyé de chemin binaire. Vérifie que le paquet est bien installé."
  );
}

// On injecte le binaire dans fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// (Optionnel) exposer le chemin via process.env si besoin de spawn manuel
process.env.FFMPEG_PATH = ffmpegPath as string;

export const FFMPEG_PATH = ffmpegPath as string;
export default ffmpeg;
