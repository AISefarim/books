import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Book, Review } from '../types';
import { StarRating } from './StarRating';

interface ReviewsModalProps {
  book: Book;
  onClose: () => void;
}

export function ReviewsModal({ book, onClose }: ReviewsModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState('');
  const [newAuthorName, setNewAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reviewsRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', book.id, 'reviews');
    const q = query(reviewsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(fetchedReviews);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching reviews:", err);
      // If index is missing or permission denied
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [book.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) {
      setError("Please write a review text.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const reviewsRef = collection(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', book.id, 'reviews');
      await addDoc(reviewsRef, {
        bookId: book.id,
        rating: newRating,
        text: newText.trim(),
        authorName: newAuthorName.trim() || 'Anonymous Reader',
        createdAt: Date.now(),
        userId: auth.currentUser?.uid || 'anonymous'
      });
      
      setNewText('');
      setNewRating(5);
      setNewAuthorName('');
    } catch (err: any) {
      console.error("Error adding review:", err);
      setError(err.message || "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" /> Reviews
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">{book.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-black text-slate-800 tracking-tighter">
                {averageRating ? averageRating.toFixed(1) : '-'}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">out of 5</div>
            </div>
            <div className="flex-1">
              <StarRating rating={Math.round(averageRating)} size="lg" readonly />
              <div className="text-sm font-medium text-slate-500 mt-2">
                Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-4">Reader Reviews</h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed">
                <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No reviews yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-slate-800">{review.authorName}</div>
                      <div className="text-xs font-medium text-slate-400 mt-0.5">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <StarRating rating={review.rating} size="sm" readonly />
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{review.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-4">Write a Review</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-100">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Rating</label>
              <StarRating rating={newRating} onRatingChange={setNewRating} size="lg" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Name (Optional)</label>
              <input
                type="text"
                value={newAuthorName}
                onChange={(e) => setNewAuthorName(e.target.value)}
                placeholder="How should we call you?"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Review</label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Share your thoughts about this sefer..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newText.trim()}
              className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Review
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
