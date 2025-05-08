import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, findNodeHandle } from 'react-native';
import {
  TextInput,
  List,
  Surface,
  ActivityIndicator,
  useTheme,
  Portal,
  Checkbox,
} from 'react-native-paper';

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Option {
  id: number;
  name: string;
}

interface AutocompleteInputProps {
  label: string;
  query: string;
  setQuery: (query: string) => void;
  options: Option[];
  onSelect: (optionId: number | null) => void;
  loading: boolean;
  onLoadSuggestions: () => void;
  onAddOption: (name: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  selectedOption: Option | null;
}

const AutocompleteInput = ({
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
}: AutocompleteInputProps) => {
  const [suggestions, setSuggestions] = useState<Option[]>(options);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textInputRef = useRef<View>(null);
  const [inputLayout, setInputLayout] = useState<Layout | null>(null);

  const theme = useTheme();

  const measureInput = useCallback(() => {
    if (textInputRef.current) {
      const nodeHandle = findNodeHandle(textInputRef.current);
      if (nodeHandle) {
        textInputRef.current.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            if (
              typeof x === 'number' &&
              typeof y === 'number' &&
              typeof width === 'number' &&
              typeof height === 'number'
            ) {
              setInputLayout({ x, y, width, height });
            } else {
              console.warn('Measurement returned invalid values:', {
                x,
                y,
                width,
                height,
              });
              setInputLayout(null);
            }
          },
        );
      } else {
        console.warn('Could not find node handle for TextInput measurement');
        setInputLayout(null);
      }
    } else {
      setInputLayout(null);
    }
  }, []);

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
    } else {
      setSuggestions(options);
    }
  }, [query, options, selectedOption]);

  const handleSelectSuggestion = (item: Option) => {
    setQuery(item.name);
    setSuggestions([]);
    setShowSuggestions(false);

    if (onSelect) {
      onSelect(item.id);
    }
  };

  const handleFocus = () => {
    measureInput();
    setShowSuggestions(true);
    onLoadSuggestions();

    if (query.length === 0) {
      setSuggestions(options);
    }

    onFocus && onFocus();
  };

  const notExactMatch =
    suggestions.findIndex(item => item.name === query) === -1;

  const handleBlur = () => {
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

  return (
    <View style={styles.container}>
      <View ref={textInputRef}>
        <TextInput
          label={label}
          value={query}
          onChangeText={setQuery}
          onBlur={handleBlur}
          onFocus={handleFocus}
        />
      </View>
      {showSuggestions && inputLayout && (
        <Portal>
          <Surface
            style={[
              styles.suggestionsContainer,
              {
                top: inputLayout?.y + inputLayout?.height + 60,
                left: inputLayout?.x,
                width: inputLayout?.width,
                backgroundColor: theme.colors.elevation.level2,
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
                        title={item.name}
                        onPress={() => handleSelectSuggestion(item)}
                        style={
                          selectedOption?.id === item.id
                            ? {
                                backgroundColor: theme.colors.secondary,
                              }
                            : null
                        }
                        left={() => (
                          <View style={{ marginLeft: 10 }}>
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
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    maxHeight: 200, // Limit height
  },
  loader: {
    paddingVertical: 10,
  },
  noResults: {
    padding: 15,
    textAlign: 'center',
    color: '#666',
  },
});

export default AutocompleteInput;
