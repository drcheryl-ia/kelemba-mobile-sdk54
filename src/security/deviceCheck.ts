/**
 * Vérifications device — intégrité, root/jailbreak.
 */
import * as Device from 'expo-device';

export const isPhysicalDevice = (): boolean => {
  return Device.isDevice;
};

export const getDeviceName = async (): Promise<string> => {
  return Device.deviceName ?? 'Unknown';
};
