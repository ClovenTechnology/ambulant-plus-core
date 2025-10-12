const mem = new Map<string, Set<string>>();

export const favsStore = {
  async list(userId: string) {
    return Array.from(mem.get(userId) ?? []);
  },
  async add(userId: string, id: string) {
    const set = mem.get(userId) ?? new Set<string>();
    set.add(id);
    mem.set(userId, set);
  },
  async remove(userId: string, id: string) {
    const set = mem.get(userId) ?? new Set<string>();
    set.delete(id);
    mem.set(userId, set);
  },
};
