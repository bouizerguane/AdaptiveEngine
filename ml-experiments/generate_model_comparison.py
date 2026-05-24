import matplotlib.pyplot as plt
import numpy as np

# Données des modèles
models = [
    "Dummy\nClassifier",
    "Logistic\nRegression",
    "Random\nForest"
]

accuracy = [0.5733, 0.7067, 0.7200]
precision = [0.5733, 0.7838, 0.8056]
f1_score = [0.7288, 0.7250, 0.7342]
roc_auc = [0.5000, 0.7769, 0.7493]

# Position des barres
x = np.arange(len(models))
width = 0.2

# Figure
plt.figure(figsize=(10, 6))

plt.bar(x - 1.5*width, accuracy, width, label='Accuracy')
plt.bar(x - 0.5*width, precision, width, label='Precision')
plt.bar(x + 0.5*width, f1_score, width, label='F1-score')
plt.bar(x + 1.5*width, roc_auc, width, label='ROC-AUC')

# Mise en forme
plt.xticks(x, models)
plt.ylabel("Score")
plt.ylim(0, 1.0)
plt.title("Comparaison des performances des modèles ML")
plt.legend()

plt.tight_layout()

# Sauvegarde
output_file = "ml-model-comparison.png"
plt.savefig(output_file, dpi=300)

print(f"Image générée : {output_file}")