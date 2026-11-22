import { NativeModules } from "react-native";
import {
  createPlayerAudioController,
  type NativeAudioModule,
} from "./player-audio-controller";

export const setPlayerAudio = createPlayerAudioController(
  NativeModules.BackinitAudio as NativeAudioModule | undefined,
);
