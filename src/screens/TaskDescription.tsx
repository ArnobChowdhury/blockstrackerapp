import React, { useState, useRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  View,
  StyleSheet,
  ColorValue,
  ScrollView,
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

  const androidApiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(Platform.Version, 10);

  const keyboardBehavior =
    Platform.OS === 'ios'
      ? 'padding'
      : androidApiLevel >= 35
      ? 'height'
      : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={keyboardBehavior}
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
        <ScrollView
          style={styles.scrollViewStyle}
          contentContainerStyle={styles.scrollContentContainer}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled">
          <View style={styles.editorContainer}>
            <RichEditor
              editorStyle={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
                cssText: `
                      /* Import or reference your custom font */
                      @font-face {
                        font-family: 'Hanken Grotesk';
                        src: local('Hanken Grotesk');
                      }

                      body {
                        font-family: 'Hanken Grotesk', -apple-system, Roboto, Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        background-color: ${theme.colors.surface};
                        color: ${theme.colors.onSurface};
                        overflow-y: auto;
                        -webkit-overflow-scrolling: touch;
                        height: 100%;
                        margin: 16px; /* optional padding inside the editor */
                      }

                      /* Ensure headings and paragraphs inherit the font */
                      h1, h2, h3, h4, h5, h6, p, span, div {
                        font-family: 'Hanken Grotesk', -apple-system, Roboto, Helvetica, Arial, sans-serif;
                      }
                    `,
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
        </ScrollView>

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
  navigationIconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  editorContainer: {
    flex: 1,
    minHeight: 300, // Gives the editor enough initial vertical breathing room
  },
  editor: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default TaskDescription;
