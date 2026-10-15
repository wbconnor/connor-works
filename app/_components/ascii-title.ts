// "Connor dot works" in figlet's Small Slant (smslant) font (DESIGN.md §6.1).
// Regenerate with: npx figlet -f "Small Slant" "Connor dot works" (and per word for `stacked`).

/** Drops the leading newline, trailing spaces and figlet's trailing blank line */
const art = (text: string) =>
  text
    .replace(/^\n/, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();

/** One line, 73 columns. Shown at ≥ md. */
export const wide = art(String.raw`
  _____                             __     __                    __
 / ___/__  ___  ___  ___  ____  ___/ /__  / /_  _    _____  ____/ /__ ___
/ /__/ _ \/ _ \/ _ \/ _ \/ __/ / _  / _ \/ __/ | |/|/ / _ \/ __/  '_/(_-<
\___/\___/_//_/_//_/\___/_/    \_,_/\___/\__/  |__,__/\___/_/ /_/\_\/___/
`);

/** One word per block, 30 columns at most. Shown below md. */
export const stacked = art(String.raw`
  _____
 / ___/__  ___  ___  ___  ____
/ /__/ _ \/ _ \/ _ \/ _ \/ __/
\___/\___/_//_/_//_/\___/_/

     __     __
 ___/ /__  / /_
/ _  / _ \/ __/
\_,_/\___/\__/

                  __
 _    _____  ____/ /__ ___
| |/|/ / _ \/ __/  '_/(_-<
|__,__/\___/_/ /_/\_\/___/
`);

/** "404" for the not-found page (DESIGN.md §7) */
export const notFound = art(String.raw`
  ____ ___  ____
 / / // _ \/ / /
/_  _/ // /_  _/
 /_/ \___/ /_/
`);
