import type { ImageSourcePropType } from 'react-native';
export const sampleImages: Record<string, ImageSourcePropType> = {
  'sample:living': require('../../assets/living.jpg'),
  'sample:kitchen': require('../../assets/kitchen.jpg'),
  'sample:bath': require('../../assets/bath.jpg'),
  'sample:room': require('../../assets/room.jpg'),
};
export function imageSource(uri: string): ImageSourcePropType { return sampleImages[uri] || { uri }; }
