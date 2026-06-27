// Required testIDs: N/A (store unit tests)
import { act, renderHook } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Minimal in-memory store — replace with the real Zustand/Redux store import
// when store entities are defined, e.g.:
//   import { useAppStore } from '../../store/useAppStore';
// ---------------------------------------------------------------------------

type Item = { id: string; name: string };
type StoreState = {
  items: Item[];
  addItem: (item: Item) => void;
  deleteItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  reset: () => void;
};

const createStore = (): StoreState => {
  let items: Item[] = [];
  const listeners: Array<() => void> = [];
  const notify = () => listeners.forEach((l) => l());

  return {
    get items() {
      return items;
    },
    addItem(item: Item) {
      items = [...items, item];
      notify();
    },
    deleteItem(id: string) {
      items = items.filter((i) => i.id !== id);
      notify();
    },
    updateItem(id: string, updates: Partial<Item>) {
      items = items.map((i) => (i.id === id ? { ...i, ...updates } : i));
      notify();
    },
    reset() {
      items = [];
      notify();
    },
  };
};

describe('App Store — core actions', () => {
  let store: StoreState;

  beforeEach(() => {
    store = createStore();
  });

  it('initialises with an empty items list', () => {
    expect(store.items).toHaveLength(0);
  });

  it('addItem adds an item to the store', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Test Item' });
    });
    expect(store.items).toHaveLength(1);
  });

  it('addItem stores the correct item data', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Test Item' });
    });
    expect(store.items[0]).toEqual({ id: '1', name: 'Test Item' });
  });

  it('deleteItem removes the correct item', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Item A' });
      store.addItem({ id: '2', name: 'Item B' });
      store.deleteItem('1');
    });
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe('2');
  });

  it('deleteItem does not affect other items', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Item A' });
      store.addItem({ id: '2', name: 'Item B' });
      store.deleteItem('1');
    });
    expect(store.items[0].name).toBe('Item B');
  });

  it('updateItem modifies the correct item', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Old Name' });
      store.updateItem('1', { name: 'New Name' });
    });
    expect(store.items[0].name).toBe('New Name');
  });

  it('updateItem does not mutate unrelated items', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Item A' });
      store.addItem({ id: '2', name: 'Item B' });
      store.updateItem('1', { name: 'Updated A' });
    });
    expect(store.items[1].name).toBe('Item B');
  });

  it('reset clears all items', () => {
    act(() => {
      store.addItem({ id: '1', name: 'Item A' });
      store.addItem({ id: '2', name: 'Item B' });
      store.reset();
    });
    expect(store.items).toHaveLength(0);
  });
});
