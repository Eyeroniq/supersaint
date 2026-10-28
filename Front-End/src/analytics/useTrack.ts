import { track, trackExposure } from "./tracker";

// Single entry point components use for analytics. Calls are queued and sent in
// batches in the background, so they never wait on the network.
export const useTrack = () => ({ track, trackExposure });
