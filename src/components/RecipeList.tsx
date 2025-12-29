import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Recipe } from '../types';
import RecipeForm from './RecipeForm';
import './RecipeList.css';

interface RecipeListProps {
  onSelectRecipe?: (recipe: Recipe) => void;
}

const RecipeList: React.FC<RecipeListProps> = ({ onSelectRecipe }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const loadRecipes = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'recipes'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const recipesData: Recipe[] = [];
      querySnapshot.forEach((doc) => {
        recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
      });
      setRecipes(recipesData);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleDelete = async (recipeId: string) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await deleteDoc(doc(db, 'recipes', recipeId));
      setRecipes(recipes.filter((r) => r.id !== recipeId));
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  const toggleExpand = (recipeId: string) => {
    setExpandedRecipe(expandedRecipe === recipeId ? null : recipeId);
  };

  if (loading) {
    return <div className="loading">Loading recipes...</div>;
  }

  return (
    <div className="recipe-list-container">
      <div className="recipe-list-header">
        <h2>My Recipes</h2>
        <button className="btn-add" onClick={() => setShowForm(true)}>
          + Add Recipe
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="empty-state">
          <p>No recipes yet. Start by adding your first recipe!</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="recipe-card">
              <div className="recipe-card-header">
                <h3>{recipe.title}</h3>
                <div className="recipe-actions">
                  {onSelectRecipe && (
                    <button
                      className="btn-icon"
                      onClick={() => onSelectRecipe(recipe)}
                      title="Add to calendar"
                    >
                      📅
                    </button>
                  )}
                  <button
                    className="btn-icon"
                    onClick={() => toggleExpand(recipe.id!)}
                    title={expandedRecipe === recipe.id ? 'Collapse' : 'Expand'}
                  >
                    {expandedRecipe === recipe.id ? '▲' : '▼'}
                  </button>
                  <button
                    className="btn-icon delete"
                    onClick={() => handleDelete(recipe.id!)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <p className="recipe-description">{recipe.description}</p>
              {expandedRecipe === recipe.id && recipe.ingredients && recipe.ingredients.length > 0 && (
                <div className="recipe-ingredients">
                  <h4>Ingredients:</h4>
                  <ul>
                    {recipe.ingredients.map((ingredient, index) => (
                      <li key={index}>{ingredient}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <RecipeForm onClose={() => setShowForm(false)} onSuccess={loadRecipes} />}
    </div>
  );
};

export default RecipeList;
