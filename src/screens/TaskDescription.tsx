import React, { useState, useRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  View,
  StyleSheet,
  ColorValue,
} from 'react-native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  actions,
  RichEditor,
  RichToolbar,
} from 'react-native-pell-rich-editor';

const handleHeadOne = ({ tintColor }: { tintColor: ColorValue }) => (
  <Text style={{ color: tintColor }}>H1</Text>
);
const handleHeadTwo = ({ tintColor }: { tintColor: ColorValue }) => (
  <Text style={{ color: tintColor }}>H2</Text>
);

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDescription'>;

const TaskDescription = ({ navigation, route }: Props) => {
  const richText = useRef<RichEditor>(null);
  const theme = useTheme();

  const { initialHTML, source } = route.params;
  const [descriptionHTML, setDescriptionHTML] = useState(initialHTML);

  const handleDescriptionAccept = () => {
    if (richText.current) {
      navigation.goBack();
      if (source === 'EditTask') {
        navigation.navigate(
          'EditTask',
          {
            updatedDescription: descriptionHTML,
          },
          { merge: true },
        );
      } else {
        navigation.navigate(
          'Drawer',
          {
            screen: 'Home',
            params: {
              screen: 'AddTask',
              params: {
                updatedDescription: descriptionHTML,
              },
            },
          },
          { merge: true },
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.navigationIconContainer}>
          <IconButton
            icon="arrow-left"
            size={20}
            onPress={() => navigation.goBack()}
          />
          <IconButton
            icon="check"
            size={22}
            iconColor={theme.colors.secondary}
            onPress={handleDescriptionAccept}
          />
        </View>
        <View style={styles.editorContainer}>
          <RichEditor
            editorStyle={{
              backgroundColor: theme.colors.surface,
              color: theme.colors.onSurface,
            }}
            initialFocus={true}
            initialContentHTML={initialHTML || ''}
            ref={richText}
            style={styles.editor}
            placeholder={'Task description...'}
            onChange={descriptionText => {
              setDescriptionHTML(descriptionText);
            }}
          />
        </View>
        <RichToolbar
          editor={richText}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.code,
            actions.undo,
            actions.redo,
          ]}
          iconMap={{
            [actions.heading1]: handleHeadOne,
            [actions.heading2]: handleHeadTwo,
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    // borderWidth: 1,
    borderColor: '#ccc',
  },
  editor: {
    flex: 1,
    paddingHorizontal: 10,
  },
  navigationIconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default TaskDescription;
