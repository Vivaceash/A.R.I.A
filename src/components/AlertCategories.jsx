import { Trash2, Edit3, FilePlus, CheckCircle } from 'lucide-react';
import './AlertCategories.css';

const AlertCategories = ({ alerts, onCategoryClick }) => {
  // Compute counts
  const eliminados = alerts.filter(a => a.type === 'Eliminado').length;
  const modificados = alerts.filter(a => a.type === 'Modificación').length;
  const creados = alerts.filter(a => a.type === 'Creación').length;
  const resueltas = alerts.filter(a => a.resolved).length;

  const categories = [
    {
      id: 'eliminados',
      title: 'Eliminados',
      count: eliminados,
      icon: <Trash2 size={24} />,
      colorClass: 'cat-red',
      filterType: 'Eliminado'
    },
    {
      id: 'modificados',
      title: 'Modificados',
      count: modificados,
      icon: <Edit3 size={24} />,
      colorClass: 'cat-blue',
      filterType: 'Modificación'
    },
    {
      id: 'creados',
      title: 'Creados',
      count: creados,
      icon: <FilePlus size={24} />,
      colorClass: 'cat-yellow',
      filterType: 'Creación'
    },
    {
      id: 'resueltas',
      title: 'Resueltas',
      count: resueltas,
      icon: <CheckCircle size={24} />,
      colorClass: 'cat-green',
      filterType: 'Resueltas'
    }
  ];

  return (
    <div className="alert-categories-container">
      <h3 className="categories-title">Categorías de Eventos</h3>
      <div className="categories-grid">
        {categories.map(cat => (
          <div 
            key={cat.id} 
            className={`category-card ${cat.colorClass}`}
            onClick={() => onCategoryClick(cat)}
          >
            <div className="category-icon-wrapper">
              {cat.icon}
            </div>
            <div className="category-info">
              <span className="category-count">{cat.count}</span>
              <span className="category-name">{cat.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertCategories;
