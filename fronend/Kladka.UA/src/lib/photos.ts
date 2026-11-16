import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
export function clearLocalPhotos() {
  if (Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, 'photos');
  if (directory.exists) directory.delete();
}
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], quality: 0.8, allowsEditing: false, selectionLimit: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const image = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1400 } }], {
    compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: Platform.OS === 'web',
  });
  if (Platform.OS === 'web') return 'data:image/jpeg;base64,' + image.base64;
  const directory = new Directory(Paths.document, 'photos');
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, Crypto.randomUUID() + '.jpg');
  new File(image.uri).copy(target);
  return target.uri;
}
