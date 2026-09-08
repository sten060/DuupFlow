/**
 * PARCOURS GUIDÉS — « par quoi tu veux commencer ? »
 *
 * Un parcours enchaîne des étapes À TRAVERS LES PAGES : on surligne un élément,
 * on explique en une phrase, le user clique, la page change, l'étape suivante
 * prend le relais. C'est la différence avec le coach de module, qui reste sur
 * une seule page.
 *
 * Chaque étape déclare la route où elle est valable. Le guide n'affiche que
 * l'étape dont la route correspond : si le user part ailleurs, le parcours
 * l'attend au lieu de le harceler.
 *
 * ⚠️ Les ancres `data-tour-id` doivent EXISTER dans les pages visées. Une ancre
 * absente = étape sautée (le guide passe à la suivante), jamais un blocage.
 */

export type EtapeParcours = {
  /** Route exacte où cette étape s'affiche. */
  route: string;
  /** Ancres data-tour-id à surligner (leur boîte englobante). */
  target: string[];
  titleKey: string;
  bodyKey: string;
  placement?: "right" | "below";
  /** L'étape se franchit en CLIQUANT la zone surlignée (typiquement un lien de
   *  navigation) : on masque alors le bouton « Suivant », c'est le geste réel
   *  qui fait avancer. Le changement de route déclenche la suite. */
  parClic?: boolean;
  /** Phrase d'action pour une étape `parClic`. Elle dit ce que le clic DONNE
   *  (« clique pour ouvrir le mode simple »), jamais « clique la zone » : le
   *  user voit déjà la zone, ce qu'il ignore c'est ce qu'il y a derrière. */
  hintKey?: string;
  /** Dernière étape d'une branche : le bouton dit « Terminé » et le parcours
   *  s'arrête là, même s'il reste des étapes après (l'autre branche). */
  fin?: boolean;
  /** Étape réservée aux comptes sans plan payant (activation). */
  siPlanFree?: boolean;
  /**
   * Mise en scène de l'étape.
   *   · absent    — bulle posée à côté d'un élément surligné (le cas normal) ;
   *   · "panneau" — grand panneau collé au bord droit, SANS cible, le reste de
   *     la page légèrement flouté. Pour les étapes qui expliquent un état plutôt
   *     que de désigner un bouton : dans l'Éditeur IA, chaque étape est une
   *     page entière à comprendre, pas un endroit où cliquer.
   */
  presentation?: "panneau";
  /** Panneau uniquement : la phrase « ce que tu fais maintenant ». */
  actionKey?: string;
  /**
   * Panneau uniquement : nombre de puces sous le chapeau (clés `…p1`, `…p2`…).
   * Un panneau est lu debout, entre deux gestes : un pavé de six lignes n'est
   * pas lu du tout. Chapeau court, puis des points qu'on balaie.
   */
  puces?: number;
  /**
   * Panneau uniquement : l'étape du module qui déclenche ce panneau. Il ne
   * s'ouvre QUE quand le user y arrive vraiment, et se referme sur « J'ai
   * compris » sans en appeler un autre — le suivant attend l'étape suivante.
   */
  moduleStep?: "connect" | "ref" | "material";
};

export type CleParcours = "dup" | "ai";

const ETAPE_PLAN: EtapeParcours = {
  route: "/dashboard",
  target: ["nav-abonnement"],
  titleKey: "onb.path.planT",
  bodyKey: "onb.path.planB",
  placement: "right",
  parClic: true,
  hintKey: "onb.path.hintPlan",
  siPlanFree: true,
};

/**
 * ⚠️ Le parcours « duplication » BIFURQUE. Au survol de « Duplication », le user
 * choisit lui-même Images ou Vidéos — le parcours ne peut pas décider à sa
 * place. Les deux branches sont donc écrites l'une après l'autre, et le guide
 * saute à celle où le user atterrit (il cherche la prochaine étape dont la
 * route correspond, pas seulement l'étape suivante). Chaque branche se termine
 * par `fin: true`, sinon celle des images enchaînerait sur celle des vidéos.
 */
export const PARCOURS: Record<CleParcours, EtapeParcours[]> = {
  dup: [
    ETAPE_PLAN,
    { route: "/dashboard", target: ["nav-duplication"], titleKey: "onb.path.dup1t", bodyKey: "onb.path.dup1b", placement: "right", parClic: true, hintKey: "onb.path.hintFormat" },

    // ── Branche IMAGES ──────────────────────────────────────────────────
    { route: "/dashboard/images", target: ["img-dropzone"], titleKey: "onb.path.img1t", bodyKey: "onb.path.img1b", placement: "right" },
    { route: "/dashboard/images", target: ["img-copies"], titleKey: "onb.path.img2t", bodyKey: "onb.path.img2b", placement: "right" },
    { route: "/dashboard/images", target: ["img-options"], titleKey: "onb.path.img3t", bodyKey: "onb.path.img3b", placement: "right" },
    { route: "/dashboard/images", target: ["img-submit"], titleKey: "onb.path.img4t", bodyKey: "onb.path.img4b", placement: "right", fin: true },

    // ── Branche VIDÉOS ──────────────────────────────────────────────────
    { route: "/dashboard/videos", target: ["video-mode-simple"], titleKey: "onb.path.dup2t", bodyKey: "onb.path.dup2b", placement: "below", parClic: true, hintKey: "onb.path.hintSimple" },
    { route: "/dashboard/videos/simple", target: ["video-dropzone"], titleKey: "onb.path.dup3t", bodyKey: "onb.path.dup3b", placement: "right" },
    { route: "/dashboard/videos/simple", target: ["video-copies"], titleKey: "onb.path.dup4t", bodyKey: "onb.path.dup4b", placement: "right" },
    { route: "/dashboard/videos/simple", target: ["video-packs"], titleKey: "onb.path.dup5t", bodyKey: "onb.path.dup5b", placement: "right" },
    { route: "/dashboard/videos/simple", target: ["video-submit"], titleKey: "onb.path.dup6t", bodyKey: "onb.path.dup6b", placement: "right", fin: true },
  ],
  ai: [
    ETAPE_PLAN,
    { route: "/dashboard", target: ["nav-ai-editor"], titleKey: "onb.path.ai1t", bodyKey: "onb.path.ai1b", placement: "right", parClic: true, hintKey: "onb.path.hintAiEditor" },
    // ⚠️ Pas de panneau sur l'étape « connexion » : la fenêtre d'ouverture du
    // module vient de dire à quoi sert Claude, et la page elle-même détaille
    // les trois gestes. Un panneau de plus là-dessus, c'est la même chose dite
    // trois fois avant d'avoir rien fait.
    { route: "/dashboard/ai-editor", target: [], titleKey: "onb.path.ai3t", bodyKey: "onb.path.ai3b", actionKey: "onb.path.ai3a", puces: 3, presentation: "panneau", moduleStep: "ref" },
    { route: "/dashboard/ai-editor", target: [], titleKey: "onb.path.ai4t", bodyKey: "onb.path.ai4b", actionKey: "onb.path.ai4a", puces: 3, presentation: "panneau", moduleStep: "material", fin: true },
  ],
};
