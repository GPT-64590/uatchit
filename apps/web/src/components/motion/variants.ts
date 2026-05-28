import type { Variants } from "framer-motion";
import { ease, dur } from "./tokens";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: dur.fade, ease: ease.out } },
};

export const stagger = (gap = 0.06): Variants => ({
  show: { transition: { staggerChildren: gap } },
});

export const msgIn: Variants = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: dur.enter, ease: ease.out } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  show:   { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.22, ease: ease.out } },
};

export const chipHover = {
  rest:  { y: 0 },
  hover: { y: -1, transition: { duration: dur.ui, ease: ease.out } },
};
