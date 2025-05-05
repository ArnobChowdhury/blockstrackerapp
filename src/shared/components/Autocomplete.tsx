import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, findNodeHandle } from 'react-native';
import {
  TextInput,
  List,
  Surface,
  ActivityIndicator,
  Text,
  useTheme,
  Portal,
} from 'react-native-paper';

const ALL_ITEMS = [
  'Apple',
  'Banana',
  'Blueberry',
  'Cherry',
  'Cranberry',
  'Grape',
  'Kiwi',
  'Lemon',
  'Lime',
  'Mango',
  'Orange',
  'Peach',
  'Pear',
  'Pineapple',
  'Strawberry',
];

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Suggestion {
  id: number | string;
  name: string;
}

interface AutocompleteInputProps {
  label: string;
  value?: string;
  suggestions: Suggestion[];
  onSelect: (item: string) => void;
}

const AutocompleteInput = ({ label, onSelect }: AutocompleteInputProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textInputRef = useRef<View>(null);
  const [inputLayout, setInputLayout] = useState<Layout | null>(null);

  const theme = useTheme();

  const measureInput = useCallback(() => {
    console.log('measuring input');
    if (textInputRef.current) {
      console.log('textInputRef.current', textInputRef.current);
      const nodeHandle = findNodeHandle(textInputRef.current);
      console.log('nodeHandle', nodeHandle);
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
      setLoading(true);
      setShowSuggestions(true);
      const timeoutId = setTimeout(() => {
        const filtered = ALL_ITEMS.filter(item =>
          item.toLowerCase().includes(query.toLowerCase()),
        );

        const notExactMatch = filtered.indexOf(query) === -1;
        console.log('exactMatch', notExactMatch);

        if (notExactMatch) {
          filtered.unshift(`Add ${query}`);
        }

        setSuggestions(filtered);
        setLoading(false);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions(ALL_ITEMS);
      // setShowSuggestions(false);
      setLoading(false);
    }
  }, [query]);

  const handleSelectSuggestion = (item: string) => {
    setQuery(item);
    setSuggestions([]);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleFocus = () => {
    measureInput();
    setShowSuggestions(true);

    if (query.length === 0) {
      setSuggestions(ALL_ITEMS);
    }
  };

  return (
    <View style={styles.container}>
      <View ref={textInputRef}>
        <TextInput
          label={label}
          value={query}
          onChangeText={setQuery}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
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
            ) : suggestions.length > 0 ? (
              <FlatList
                data={suggestions}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <List.Item
                    title={item}
                    onPress={() => handleSelectSuggestion(item)}
                  />
                )}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <Text style={styles.noResults}>No results found</Text>
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
