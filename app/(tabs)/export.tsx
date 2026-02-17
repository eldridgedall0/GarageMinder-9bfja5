import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTrips } from '../../hooks/useTrips';
import { useVehicles } from '../../hooks/useVehicles';
import { useAlert } from '@/template';
import { exportToCSV, exportToJSON, shareExportedFile, generateMileageReport } from '../../services/exportService';

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { allTrips } = useTrips();
  const { vehicles } = useVehicles();
  const { showAlert } = useAlert();
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (allTrips.length === 0) {
      showAlert('No Data', 'No trips available to export');
      return;
    }

    setExporting(true);
    try {
      const csv = await exportToCSV(allTrips, vehicles);
      const success = await shareExportedFile(csv, 'csv');
      
      if (success) {
        showAlert('Success', 'Trip data exported successfully');
      } else {
        showAlert('Error', 'Failed to share export file');
      }
    } catch (error) {
      showAlert('Error', 'Failed to export trips');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (allTrips.length === 0) {
      showAlert('No Data', 'No trips available to export');
      return;
    }

    setExporting(true);
    try {
      const json = await exportToJSON(allTrips, vehicles);
      const success = await shareExportedFile(json, 'json');
      
      if (success) {
        showAlert('Success', 'Trip data exported successfully');
      } else {
        showAlert('Error', 'Failed to share export file');
      }
    } catch (error) {
      showAlert('Error', 'Failed to export trips');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateReport = () => {
    if (allTrips.length === 0) {
      showAlert('No Data', 'No trips available for report');
      return;
    }

    const report = generateMileageReport(allTrips, vehicles);
    showAlert('Mileage Report', report);
  };

  const totalMiles = allTrips.reduce(
    (sum, trip) => sum + (trip.adjustedDistance || trip.calculatedDistance),
    0
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Export & Reports</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="list" size={32} color={theme.colors.primary} />
              <Text style={styles.statValue}>{allTrips.length}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="straighten" size={32} color={theme.colors.primary} />
              <Text style={styles.statValue}>{totalMiles.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Total Miles</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="directions-car" size={32} color={theme.colors.primary} />
              <Text style={styles.statValue}>{vehicles.length}</Text>
              <Text style={styles.statLabel}>Vehicles</Text>
            </View>
          </View>
        </Card>

        {/* Export Options */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="download" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Export Data</Text>
          </View>

          <Text style={styles.sectionDescription}>
            Export your trip data in CSV or JSON format for tax purposes, record keeping, or backup.
          </Text>

          <View style={styles.exportButtons}>
            <Pressable
              style={({ pressed }) => [styles.exportOption, pressed && styles.exportOptionPressed]}
              onPress={handleExportCSV}
              disabled={exporting}
            >
              <MaterialIcons name="table-chart" size={48} color={theme.colors.primary} />
              <Text style={styles.exportOptionTitle}>CSV Format</Text>
              <Text style={styles.exportOptionDescription}>
                Compatible with Excel and Google Sheets
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.exportOption, pressed && styles.exportOptionPressed]}
              onPress={handleExportJSON}
              disabled={exporting}
            >
              <MaterialIcons name="code" size={48} color={theme.colors.primary} />
              <Text style={styles.exportOptionTitle}>JSON Format</Text>
              <Text style={styles.exportOptionDescription}>
                Complete data with all details
              </Text>
            </Pressable>
          </View>

          {exporting && (
            <View style={styles.exportingIndicator}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.exportingText}>Preparing export...</Text>
            </View>
          )}
        </Card>

        {/* Reports */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="assessment" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Reports</Text>
          </View>

          <Text style={styles.sectionDescription}>
            Generate summary reports for your mileage tracking.
          </Text>

          <Button
            title="Generate Mileage Report"
            onPress={handleGenerateReport}
            variant="secondary"
            style={styles.reportButton}
          />
        </Card>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <MaterialIcons name="privacy-tip" size={16} color={theme.colors.textSubtle} />
          <Text style={styles.privacyText}>
            Your data never leaves your device until you explicitly export or sync it
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  statsCard: {
    marginBottom: theme.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginTop: 4,
    includeFontPadding: false,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    includeFontPadding: false,
  },
  sectionDescription: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.bodyMedium * theme.typography.lineHeightRelaxed,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  exportOption: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  exportOptionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  exportOptionTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    includeFontPadding: false,
  },
  exportOptionDescription: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    marginTop: 4,
    includeFontPadding: false,
  },
  exportingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: `${theme.colors.primary}10`,
    borderRadius: theme.borderRadius.sm,
  },
  exportingText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
    includeFontPadding: false,
  },
  reportButton: {
    marginTop: theme.spacing.sm,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  privacyText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    flex: 1,
    includeFontPadding: false,
  },
});
