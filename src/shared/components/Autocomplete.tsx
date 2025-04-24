import React, {useState, useEffect} from 'react';
import {View, StyleSheet, FlatList} from 'react-native';
import {
  TextInput,
  List,
  Surface,
  ActivityIndicator,
  Text,
  useTheme,
} from 'react-native-paper';

// Sample data (replace with your actual data source/API call)
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

const AutocompleteInput = ({label, onSelect, ...textInputProps}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const theme = useTheme();

  // Effect to filter suggestions when query changes (add debouncing here in a real app)
  useEffect(() => {
    if (query.length > 0) {
      setLoading(true);
      setShowSuggestions(true);
      // Simulate filtering/fetching
      const timeoutId = setTimeout(() => {
        const filtered = ALL_ITEMS.filter(item =>
          item.toLowerCase().includes(query.toLowerCase()),
        );
        setSuggestions(filtered);
        setLoading(false);
      }, 300); // Simulate network delay/debounce

      return () => clearTimeout(timeoutId); // Cleanup timeout
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
  }, [query]);

  const handleSelectSuggestion = (item: string) => {
    setQuery(item); // Update input text
    setSuggestions([]); // Clear suggestions
    setShowSuggestions(false); // Hide list
    if (onSelect) {
      onSelect(item); // Notify parent component
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        label={label}
        value={query}
        onChangeText={setQuery}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Hide on blur with delay
        onFocus={() => query.length > 0 && setShowSuggestions(true)} // Show if query exists on focus
        {...textInputProps} // Pass other TextInput props
      />
      {showSuggestions && (
        <Surface
          style={[
            styles.suggestionsContainer,
            {backgroundColor: theme.colors.elevation.level2},
          ]}>
          {loading ? (
            <ActivityIndicator animating={true} style={styles.loader} />
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={item => item}
              renderItem={({item}) => (
                <List.Item
                  title={item}
                  onPress={() => handleSelectSuggestion(item)}
                  // You can add icons or customize further
                />
              )}
              keyboardShouldPersistTaps="handled" // Important for interaction
            />
          ) : (
            <Text style={styles.noResults}>No results found</Text> // Show no results message
          )}
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative', // Needed for absolute positioning of suggestions
    zIndex: 1, // Ensure suggestions appear above other content if needed
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60, // Adjust based on TextInput height + desired gap
    left: 0,
    right: 0,
    maxHeight: 200, // Limit height
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    elevation: 4, // Add shadow (Android)
    shadowColor: '#000', // iOS shadow
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 2, // Ensure suggestions are above the input
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

// --- How to use it in AddTaskScreen ---
/*
import AutocompleteInput from './AutocompleteInput'; // Adjust path

const AddTaskScreen = ({}: Props) => {
  // ... other state ...
  const [selectedFruit, setSelectedFruit] = useState('');

  // ... other handlers ...

  return (
    <SafeAreaView style={styles.container}>
      <AutocompleteInput
        label="Select a Fruit"
        onSelect={(item) => {
          console.log('Selected:', item);
          setSelectedFruit(item);
        }}
        style={styles.textInput} // Apply your existing textInput style
      />
      {/* Display selected fruit if needed *\/}
      {/* {selectedFruit ? <Text>You selected: {selectedFruit}</Text> : null} *\/}

      {/* ... rest of your form ... *\/}
    </SafeAreaView>
  );
};
*/
