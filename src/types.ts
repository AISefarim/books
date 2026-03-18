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
}
