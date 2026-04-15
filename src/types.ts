export interface Book {
  id: string;
  title: string;
  author: string;
  desc: string;
  buyLink: string;
  category?: string;
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
}

export interface Video {
  id: string;
  title: string;
  url: string;
  category: string;
  createdAt: number;
  views?: number;
}
