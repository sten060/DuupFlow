/**
 * Ancien module « Détection IA ».
 *
 * Ce n'est plus un module à part : c'est désormais l'option « Retirer la
 * détection IA » de la duplication (vidéo simple / avancé, images). Le code du
 * module (AiDetectionClient, actions) est volontairement CONSERVÉ — l'API
 * /api/v1/ai-detection et le pipeline le réutilisent. Cette page ne fait que
 * renvoyer les anciens liens/favoris vers la duplication vidéo.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AiDetectionPage() {
  redirect("/dashboard/videos");
}
