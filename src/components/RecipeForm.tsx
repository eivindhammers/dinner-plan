import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './RecipeForm.css';

interface RecipeFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const RecipeForm: React.FC<RecipeFormProps> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const ingredientsList = ingredients
        .split('\n')
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      await addDoc(collection(db, 'recipes'), {
        title: title.trim(),
        description: description.trim(),
        ingredients: ingredientsList.length > 0 ? ingredientsList : [],
        userId: currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Failed to create recipe: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Recipe</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Spaghetti Carbonara"
              required
            />
          </div>
          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the dish..."
              rows={4}
              required
            />
          </div>
          <div className="form-group">
            <label>Ingredients (optional, one per line)</label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="200g pasta&#10;100g bacon&#10;2 eggs&#10;Parmesan cheese"
              rows={6}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Adding...' : 'Add Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeForm;
