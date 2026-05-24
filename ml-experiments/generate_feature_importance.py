import pandas as pd
import matplotlib.pyplot as plt
import os

try:
    csv_file = "feature_importance.csv"

    # Vérifier fichier
    if not os.path.exists(csv_file):
        print(f"ERREUR : {csv_file} introuvable")
        exit()

    # Charger données
    df = pd.read_csv(csv_file)

    print("Colonnes détectées :")
    print(df.columns.tolist())

    print(df.head())

    # Adapter noms colonnes automatiquement
    feature_col = df.columns[0]
    importance_col = df.columns[1]

    # Trier
    df = df.sort_values(by=importance_col, ascending=True)

    # Plot
    plt.figure(figsize=(10, 6))
    plt.barh(df[feature_col], df[importance_col])

    plt.xlabel("Importance")
    plt.ylabel("Variables")
    plt.title("Importance des variables - Random Forest")

    plt.tight_layout()

    output_file = "feature-importance.png"
    plt.savefig(output_file, dpi=300)

    print(f"Image générée : {output_file}")

except Exception as e:
    print("ERREUR :", str(e))