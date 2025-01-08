export interface Release {
  tagName: string;
  publishedAt: string;
}

export interface Tag {
  name: string;
  publishedAt: string;
}

export interface VersionInfo {
  name: string;
  publishedAt: string;
  type: 'release' | 'tag';
}

export interface Issue {
  number: number;
  title: string;
  createdAt: string;
  url: string;
  version?: VersionInfo;
  isCreatedAfterVersion?: boolean;
}
