export type Obj = Record<PropertyKey, any>

export interface Argv {
  branch?: string;
  glob?: string;
  help?: boolean;
  version?: boolean;
  list?: boolean;
  debug?: boolean;
  force?: boolean;
  prune?: boolean;
  config?: string;
  restore?: boolean;
  _: string[];
}

// appConfig
export interface AppConfig {
  application: {
    name: string;
  }
  configuration_files: Record<string, boolean>
  xdg_configuration_files: Record<string, boolean>
}

// config
type Storage = {
  directory?: string;
  logs?: string;
  path?: string;
}

export interface Config {
  storage?: Storage;
  applications_to_sync?: Record<string, boolean>;
  applications_to_ignore?: Record<string, boolean>;
}