export interface Release {
  tagName: string;
  publishedAt: string;
}

export interface Issue {
  number: number;
  title: string;
  createdAt: string;
  url: string;
  release?: Release;
  isCreatedAfterRelease?: boolean;
}
