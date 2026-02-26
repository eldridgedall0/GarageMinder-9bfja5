import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { TripListItem } from '../../components/trip/TripListItem';
import { EmptyTrips } from '../../components/trip/EmptyTrips';
import { Button } from '../../components/ui/Button';
import { useTrips } from '../../hooks/useTrips';
import { useVehicles } from '../../hooks/useVehicles';
import { syncTrips } from '../../services/tripService';
import { forceUpdateOdometerOnServer, acceptServerOdometer } from '../../services/vehicleService';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { TripStatus } from '../../types/trip';

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { trips, allTrips, loading, filters, setFilters, refreshTrips, getPendingCount } = useTrips();
  const { vehicles, refreshVehicles } = useVehicles();
  const { reloadVehicles } = useAuth();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTrips();
    setRefreshing(false);
  };

  const handleDiscrepancy = async (discrepancy: {
    vehicleId: string;
    vehicleName: string;
    localOdometer: number;
    serverOdometer: number;
  }) => {
    return new Promise<void>((resolve) => {
      showAlert(
        'Odometer Discrepancy',
        `${discrepancy.vehicleName}\n\nYour device: ${discrepancy.localOdometer.toLocaleString()} mi\nWeb app (server): ${discrepancy.serverOdometer.toLocaleString()} mi\n\nThe web app has a different odometer value. Which value would you like to keep?`,
        [
          {
            text: `Keep Server (${discrepancy.serverOdometer.toLocaleString()})`,
            onPress: async () => {
              try {
                await acceptServerOdometer(discrepancy.vehicleId, discrepancy.serverOdometer);
              } catch (e) {
                console.error('[TripsScreen] Failed to accept server odometer:', e);
              }
              resolve();
            },
          },
          {
            text: `Use Local (${discrepancy.localOdometer.toLocaleString()})`,
            onPress: async () => {
              try {
                await forceUpdateOdometerOnServer(discrepancy.vehicleId, discrepancy.localOdometer);
              } catch (e: any) {
                showAlert('Update Failed', e?.message || 'Failed to update server odometer. You can try again later.');
              }
              resolve();
            },
          },
          {
            text: 'Skip (Decide Later)',
            style: 'cancel',
            onPress: () => resolve(),
          },
        ]
      );
    });
  };

  const handleSync = async () => {
    const pendingTrips = allTrips.filter(t => t.status === 'completed' || t.status === 'edited');
    
    if (pendingTrips.length === 0) {
      showAlert('No Trips to Sync', 'All trips are already synced');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncTrips(pendingTrips.map(t => t.id));

      if (result.success) {
        // Handle discrepancies one at a time
        if (result.discrepancies && result.discrepancies.length > 0) {
          for (const discrepancy of result.discrepancies) {
            await handleDiscrepancy(discrepancy);
          }
        }

        showAlert('Sync Complete', `${result.synced} trip${result.synced !== 1 ? 's' : ''} synced successfully`);
        
        // Refresh both trips and vehicles to reflect updated data
        await refreshTrips();
        await reloadVehicles();
      } else {
        showAlert('Sync Failed', 'Unable to sync trips. Please check your connection and try again.');
      }
    } catch (error: any) {
      console.error('[TripsScreen] Sync error:', error);
      showAlert('Sync Error', error?.message || 'An unexpected error occurred during sync.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFilterByStatus = (status: TripStatus | 'all' | 'pending') => {
    setFilters({ ...filters, status });
    setShowFilters(false);
  };

  const handleTripPress = (tripId: string) => {
    router.push({ pathname: '/trip-details', params: { tripId } });
  };

  const pendingCount = getPendingCount();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
        {pendingCount > 0 && (
          <Button
            title={syncing ? 'Syncing...' : `Sync ${pendingCount}`}
            onPress={handleSync}
            size="small"
            loading={syncing}
            disabled={syncing}
          />
        )}
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <Pressable
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <MaterialIcons name="filter-list" size={20} color={theme.colors.primary} />
          <Text style={styles.filterButtonText}>
            {filters.status === 'all' ? 'All Trips' : 
             filters.status === 'pending' ? 'Pending Sync' :
             filters.status === 'synced' ? 'Synced' : 'Filter'}
          </Text>
          <MaterialIcons 
            name={showFilters ? 'expand-less' : 'expand-more'} 
            size={20} 
            color={theme.colors.primary} 
          />
        </Pressable>
      </View>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filterOptions}>
          <Pressable
            style={[styles.filterOption, filters.status === 'all' && styles.filterOptionActive]}
            onPress={() => handleFilterByStatus('all')}
          >
            <Text style={[styles.filterOptionText, filters.status === 'all' && styles.filterOptionTextActive]}>
              All Trips
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterOption, filters.status === 'pending' && styles.filterOptionActive]}
            onPress={() => handleFilterByStatus('pending')}
          >
            <Text style={[styles.filterOptionText, filters.status === 'pending' && styles.filterOptionTextActive]}>
              Pending Sync
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterOption, filters.status === 'synced' && styles.filterOptionActive]}
            onPress={() => handleFilterByStatus('synced')}
          >
            <Text style={[styles.filterOptionText, filters.status === 'synced' && styles.filterOptionTextActive]}>
              Synced
            </Text>
          </Pressable>
        </View>
      )}

      {/* Trip List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : trips.length === 0 ? (
        <EmptyTrips />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TripListItem
              trip={item}
              vehicle={vehicles.find(v => v.id === item.vehicleId) || null}
              onPress={() => handleTripPress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  filterBar: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
    includeFontPadding: false,
  },
  filterOptions: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  filterOption: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterOptionActive: {
    backgroundColor: `${theme.colors.primary}20`,
    borderColor: theme.colors.primary,
  },
  filterOptionText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  filterOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weightSemiBold,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});