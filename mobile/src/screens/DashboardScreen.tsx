import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Welcome to Expense Tracker</Text>
      <Text style={styles.description}>
        Track your expenses, manage groups, and split bills with friends
      </Text>
      <Text className="text-3xl bg-red-500">
        This is a big text
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    color: "#666",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#888",
    lineHeight: 24,
  },
});
