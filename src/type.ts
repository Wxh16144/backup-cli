export interface Argv {
  branch?: string;
  glob?: string;
  help?: boolean;
  version?: boolean;
  list?: boolean;
  debug?: boolean;
  force?: boolean;
  _: string[];
}


// config
type Storage = {
  directory?: string;
}

export interface Config {
  storage?: Storage;
  applications_to_sync?: Record<string, boolean>;
  applications_to_ignore?: Record<string, boolean>;
}