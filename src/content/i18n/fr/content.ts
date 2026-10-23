/**
 * French texts, domain `content`: what the characters cry in the street (render/crowd.ts, render/belongings.ts). Keys
 * are `content.*`. The longer joke lists (the President's quotes, the Caïds' slogans) live in content/quotes.ts and
 * content/caids.ts, one list per language.
 */
export const frContent = {
  // the rescue victim (render/crowd.ts)
  'content.bubble.help': 'À L’AIDE !',
  'content.bubble.thanks': 'MERCI !',
  // what the peaceful groups grumble about, in turn (never aimed at anyone in particular)
  'content.grumble.0': 'ÇA SUFFIT !',
  'content.grumble.1': 'ON EN A MARRE !',
  'content.grumble.2': 'ARRÊTEZ ÇA !',
  'content.grumble.3': 'STOP À LA CASSE !',
  'content.grumble.4': 'C’EST HONTEUX !',
  // the victim's cry for a stolen belonging (ids from src/sim/incidents/rescue.ts RESCUE_ITEMS)
  'content.shout.handbag': 'MON SAC !',
  'content.shout.hat': 'MON CHAPEAU !',
  'content.shout.cane': 'MA CANNE !',
  'content.shout.backpack': 'MON SAC À DOS !',
  'content.shout.scarf': 'MON ÉCHARPE !',
  'content.shout.cap': 'MA CASQUETTE !',
} as const;
