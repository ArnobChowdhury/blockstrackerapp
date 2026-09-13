import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Keyboard,
  StatusBar,
  Platform,
} from 'react-native';
import {
  TextInput,
  List,
  Surface,
  ActivityIndicator,
  useTheme,
  Portal,
  Checkbox,
  Text,
} from 'react-native-paper';

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Option {
  id: string;
  name: string;
}

interface AutocompleteInputProps {
  label: string;
  query: string;
  setQuery: (query: string) => void;
  options: Option[];
  onSelect: (optionId: string | null) => void;
  loading: boolean;
  onLoadSuggestions: () => void;
  onAddOption: (name: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  selectedOption: Option | null;
}

export interface AutocompleteInputHandles {
  remeasure: () => void;
}

const AutocompleteInput = forwardRef<
  AutocompleteInputHandles,
  AutocompleteInputProps
>(
  (
    {
      label,
      query,
      setQuery,
      options,
      loading,
      onSelect,
      onLoadSuggestions,
      onAddOption,
      selectedOption,
      onFocus,
      onBlur,
    },
    ref,
  ) => {
    const [suggestions, setSuggestions] = useState<Option[]>(options);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const textInputRef = useRef<View>(null);
    const [inputLayout, setInputLayout] = useState<Layout | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const theme = useTheme();
    const measureAndSetLayout = useCallback(() => {
      if (textInputRef.current) {
        textInputRef.current.measureInWindow((x, y, width, height) => {
          if (
            typeof x === 'number' &&
            !isNaN(x) &&
            typeof y === 'number' &&
            !isNaN(y) &&
            typeof width === 'number' &&
            !isNaN(width) &&
            width > 0 &&
            typeof height === 'number' &&
            !isNaN(height) &&
            height > 0
          ) {
            setInputLayout({ x, y, width, height });
          }
        });
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        remeasure: measureAndSetLayout,
      }),
      [measureAndSetLayout],
    );

    useEffect(() => {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow',
        measureAndSetLayout,
      );
      const keyboardDidHideListener = Keyboard.addListener(
        'keyboardDidHide',
        measureAndSetLayout,
      );

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }, [measureAndSetLayout]);

    useEffect(() => {
      if (selectedOption) {
        setQuery(selectedOption.name);
      }
    }, [selectedOption, setQuery]);

    useEffect(() => {
      if (query.length > 0) {
        if (!selectedOption || selectedOption.name !== query) {
          setShowSuggestions(true);
        }
        const timeoutId = setTimeout(() => {
          const filtered = options.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          );

          setSuggestions(filtered);
        }, 300);

        return () => clearTimeout(timeoutId);
      } else if (isFocused) {
        setSuggestions(options);
      }
    }, [query, options, selectedOption, isFocused]);

    const handleSelectSuggestion = (item: Option) => {
      setQuery(item.name);
      setSuggestions([]);
      setShowSuggestions(false);

      if (onSelect) {
        onSelect(item.id);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
      measureAndSetLayout();
      setShowSuggestions(true);
      onLoadSuggestions();

      if (query.length === 0) {
        setSuggestions(options);
      }

      onFocus && onFocus();
    };

    const handleBlur = () => {
      setIsFocused(false);
      setTimeout(() => setShowSuggestions(false), 150);
      if (!selectedOption || selectedOption.name !== query) {
        setQuery('');
        setSuggestions(options);
        if (onSelect) {
          onSelect(null);
        }
      }
      onBlur && onBlur();
    };

    const notExactMatch =
      suggestions.findIndex(item => item.name === query) === -1;

    const surfaceRef = useRef<View>(null);
    const [suggestionsHeight, setSuggestionsHeight] = useState(0);

    useEffect(() => {
      if (inputLayout && showSuggestions && isFocused) {
        const animationFrameId = requestAnimationFrame(() => {
          surfaceRef.current?.measure((_x, _y, _width, height) => {
            if (height > 0) {
              setSuggestionsHeight(height);
            }
          });
        });

        return () => cancelAnimationFrame(animationFrameId);
      }
    }, [inputLayout, showSuggestions, isFocused]);

    const apiLevel =
      typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;

    // Android 15+ edge-to-edge shifts coordinates down by the status bar height
    const statusBarOffset =
      Platform.OS === 'android' && apiLevel >= 35
        ? StatusBar.currentHeight || 0
        : 0;

    const top = (inputLayout?.y || 0) - suggestionsHeight - 8 + statusBarOffset;

    return (
      <View>
        <View ref={textInputRef} onLayout={measureAndSetLayout}>
          <TextInput
            label={label}
            value={query}
            onChangeText={setQuery}
            onBlur={handleBlur}
            onFocus={handleFocus}
          />
        </View>
        {showSuggestions &&
          isFocused &&
          inputLayout &&
          (suggestions.length > 0 || query.length > 0) && (
            <Portal>
              <Surface
                ref={surfaceRef}
                onLayout={e => {
                  console.log(
                    '[AutocompleteInput] onLayout:',
                    e.nativeEvent.layout,
                  );
                }}
                style={[
                  styles.suggestionsContainer,
                  {
                    top,
                    left: inputLayout?.x,
                    width: inputLayout?.width, // Match input width
                    borderColor: theme.colors.primary,
                  },
                ]}>
                {loading ? (
                  <ActivityIndicator animating={true} style={styles.loader} />
                ) : (
                  <>
                    {notExactMatch && query && (
                      <List.Item
                        title={`Create "${query}"`}
                        onPress={() => onAddOption(query)}
                        left={props => <List.Icon {...props} icon="plus" />}
                      />
                    )}
                    {suggestions.length > 0 && (
                      <FlatList
                        data={suggestions}
                        keyExtractor={item => item.id.toString()}
                        renderItem={({ item }) => (
                          <List.Item
                            title={
                              <Text variant="bodyMedium">{item.name}</Text>
                            }
                            onPress={() => handleSelectSuggestion(item)}
                            style={[
                              selectedOption?.id === item.id
                                ? {
                                    backgroundColor: theme.colors.secondary,
                                  }
                                : null,
                            ]}
                            left={() => (
                              <View style={styles.marginLeft}>
                                <Checkbox
                                  status={
                                    selectedOption?.id === item.id
                                      ? 'checked'
                                      : 'unchecked'
                                  }
                                  onPress={() => handleSelectSuggestion(item)}
                                />
                              </View>
                            )}
                          />
                        )}
                        keyboardShouldPersistTaps="handled"
                      />
                    )}
                  </>
                )}
              </Surface>
            </Portal>
          )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  suggestionsContainer: {
    maxHeight: 200,
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden',
  },
  loader: {
    paddingVertical: 10,
  },
  marginLeft: {
    marginLeft: 10,
  },
});

export default AutocompleteInput;
