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
}

export interface Review {
  id: string;
  bookId: string;
  rating: number;
  text: string;
  authorName: string;
  createdAt: number;
}
