export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export type LootEntry = {
  name?: string;
  type?: string;
  weight?: number;
  [key: string]: JSONValue;
};

export type LootPool = {
  entries?: LootEntry[];
  rolls?: JSONValue;
  conditions?: JSONValue[];
  [key: string]: JSONValue;
};

export type LootTable = {
  id?: string;
  name?: string;
  type?: string;
  pools?: LootPool[];
  version?: number;
  [key: string]: JSONValue;
};
