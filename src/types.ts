export interface Book {
  id: string;
  title: string;
  author: string;
  desc: string;
  buyLink: string;
  category?: string;
  series?: string;
  cover: string;
  epub: string;
  coverPath: string;
  epubPath: string;
  createdAt: number;
  order?: number;
  isSettingsDoc?: boolean;
  readCount?: number;
  downloadCount?: number;
  isFeatured?: boolean;
  type?: 'sefer' | 'video' | 'audio' | 'podcast';
}

export interface Audio {
  id: string;
  title: string;
  url: string;
  category?: string;
  folder?: string;
  subfolder?: string;
  createdAt: number;
  order?: number;
  type?: 'audio';
  duration?: string;
  topics?: string[] | string;
  description?: string;
}

export interface Video {
  id: string;
  title: string;
  url: string;
  category: string;
  folder?: string;
  subfolder?: string;
  createdAt: number;
  views?: number;
  type?: 'video' | 'audio';
  order?: number;
  ratingsSum?: number;
  ratingsCount?: number;
  comments?: { id: string, name: string, text: string, createdAt: number }[];
  duration?: string;
  topics?: string[] | string;
  description?: string;
  bookId?: string;
}

export type Media = Video;
