import type { ImageSourcePropType } from 'react-native';

/** Native: lossless PNG (bundled in the app binary). Web uses lionAsset.web.ts (WebP, ~6× smaller download). */
export const LION: ImageSourcePropType = require('../../assets/images/lion-hero-realistic.png');
