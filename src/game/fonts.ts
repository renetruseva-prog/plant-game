// Deep imports: pulling from the package root would bundle every weight of
// both families, which is several megabytes of fonts the game never uses.
import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Newsreader_500Medium_Italic } from '@expo-google-fonts/newsreader/500Medium_Italic';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

export const FONTS = {
  body: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  black: 'BricolageGrotesque_800ExtraBold',
  /** Italic serif, used for the Latin species names on the specimen tag. */
  latin: 'Newsreader_500Medium_Italic',
} as const;

/** The evil plant swaps the whole interface to a terminal face. */
export const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
}) as string;

export function useGameFonts() {
  const [loaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Newsreader_500Medium_Italic,
  });
  return loaded;
}

/** Picks the right family for a slot, honouring the evil takeover. */
export function family(slot: keyof typeof FONTS, evil: boolean) {
  return evil ? MONO : FONTS[slot];
}
