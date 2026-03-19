import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MediaTypeOptions } from 'expo-image-picker';
import { logger } from '@/utils/logger';

export interface AvatarPickerProps {
  imageUri: string | null;
  onImageSelected: (uri: string | null) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  imageUri,
  onImageSelected,
}) => {
  const handlePress = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (e: unknown) {
      logger.error('Avatar picker error', {
        message: e instanceof Error ? e.message : String(e),
      });
      onImageSelected(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        style={styles.avatarWrapper}
        accessibilityRole="button"
        accessibilityLabel="Ajouter photo"
      >
        <View style={styles.avatarCircle}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person-outline" size={40} color="#94A3B8" />
          )}
        </View>
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
      <Text style={styles.addPhotoLabel}>Ajouter photo</Text>
      <Text style={styles.optionalLabel}>Optionnel</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 8,
  },
  optionalLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
