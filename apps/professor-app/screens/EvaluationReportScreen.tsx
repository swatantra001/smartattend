import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { AssignmentAPI } from '../src/services/api';
import { useLocalSearchParams } from 'expo-router';

// export default function EvaluationReportScreen({ route }: { route: any }) {
export default function EvaluationReportScreen() { // 🟢 Delete the props!
  // const { assignmentId } = route.params;
  const { assignmentId } = useLocalSearchParams(); // 🟢 The Expo Router way
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_submissions: 0, flagged_count: 0 });
  const [clusters, setClusters] = useState<any[]>([]);
  const [cleanSubmissions, setCleanSubmissions] = useState<any[]>([]);

  // Flagging Modal State
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('Highly similar submissions detected by AI Clustering.');
  const [isFlagging, setIsFlagging] = useState(false);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    try {
      const res = await AssignmentAPI.getEvaluationReport(assignmentId as string);
      setStats(res.data.stats);
      setClusters(res.data.clusters || []);
      setCleanSubmissions(res.data.clean_submissions || []);
    } catch (e) { Alert.alert("Error", "Failed to load report data"); }
    finally { setLoading(false); }
  };

  const openFlagModal = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    setIsFlagModalOpen(true);
  };

  const confirmFlagging = async () => {
    if (!selectedClusterId) return;
    setIsFlagging(true);
    try {
      // 🟢 Uses your exact api.ts format: flagCluster(id, reason)
      await AssignmentAPI.flagCluster(selectedClusterId, flagReason);
      Alert.alert("Success", "Students flagged and notified.");
      setIsFlagModalOpen(false);
      fetchReport(); // Refresh data
    } catch (e) { Alert.alert("Error", "Failed to flag cluster."); }
    finally { setIsFlagging(false); }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#8b5cf6" />;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Statistics Header */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total_submissions}</Text>
            <Text style={styles.statLabel}>Total Evaluated</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#ef4444' }]}>{stats.flagged_count}</Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </View>
        </View>

        {/* ─── CLUSTERS (COPIED) SECTION ─── */}
        <Text style={styles.subHeader}>Detected Clusters ({clusters.length})</Text>

        {clusters.length === 0 ? (
          <Text style={{ color: 'gray', marginLeft: 5, marginBottom: 20 }}>No copying detected.</Text>
        ) : (
          clusters.map((item, index) => (
            <View key={item.cluster_id} style={styles.clusterCard}>
              <View style={styles.clusterHeader}>
                {/* 🟢 FIX: Now using the properly separated variables from the backend */}
                <Text style={styles.probabilityText}>
                  🔄 Match Probability: {((item.match_probability || 0) * 100).toFixed(1)}%
                </Text>
                <Text style={styles.aiText}>
                  🤖 AI Written Probability: {((item.ai_written_probability || 0) * 100).toFixed(1)}%
                </Text>
              </View>

              <Text style={styles.roleLabel}>Primary Source (Leader):</Text>
              <Text style={styles.studentName}>• {item.leader_name} ({item.leader_roll})</Text>

              {item.copiers && item.copiers.length > 0 && (
                <>
                  <Text style={[styles.roleLabel, { marginTop: 10 }]}>Highly Similar Submissions:</Text>
                  {item.copiers.map((copier: any, idx: number) => (
                    <Text key={idx} style={styles.studentName}>• {copier.name} ({copier.roll_no})</Text>
                  ))}
                </>
              )}

              <TouchableOpacity style={styles.flagBtn} onPress={() => openFlagModal(item.cluster_id)}>
                <Text style={styles.flagBtnText}>⚠️ Flag This Cluster</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ─── CLEAN SUBMISSIONS SECTION ─── */}
        <View style={styles.divider} />
        <Text style={styles.subHeader}>Independent Submissions ({cleanSubmissions.length})</Text>

        {cleanSubmissions.length === 0 ? (
          <Text style={{ color: 'gray', marginLeft: 5 }}>All submissions were flagged in clusters.</Text>
        ) : (
          cleanSubmissions.map((student) => (
            <View key={student.id} style={styles.cleanCard}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>✅</Text>
              {/* 🟢 FIX: Added paddingRight and numberOfLines to prevent text from pushing into the AI score */}
              <View style={{ flex: 1, paddingRight: 10, justifyContent: 'center' }}>
                <Text style={styles.cleanName} numberOfLines={1}>{student.name}</Text>
                <Text style={styles.cleanRoll}>{student.roll_no}</Text>
              </View>
             {/* 🟢 FIX: Added a minWidth so the AI score box always has enough breathing room */}
              <View style={{ alignItems: 'flex-end', minWidth: 80, justifyContent: 'center' }}>
                 <Text style={{ fontSize: 11, color: '#047857', fontWeight: 'bold' }}>AI Written</Text>
                 <Text style={{ fontSize: 16, color: '#059669', fontWeight: '900' }}>
                   {((student.ai_score || 0) * 100).toFixed(1)}%
                 </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ─── FLAGGING REASON MODAL ─── */}
      <Modal visible={isFlagModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Flag Academic Violation</Text>
            <Text style={{ color: '#475569', marginBottom: 10, fontSize: 13 }}>
              Provide a reason. This will be sent as a push notification to all students in this cluster.
            </Text>

            <TextInput
              style={styles.reasonInput}
              multiline
              value={flagReason}
              onChangeText={setFlagReason}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsFlagModalOpen(false)}>
                <Text style={{ fontWeight: 'bold', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmFlagBtn} onPress={confirmFlagging} disabled={isFlagging}>
                {isFlagging ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontWeight: 'bold', color: '#fff' }}>Flag Students</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8', padding: 15 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { flex: 0.48, backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center', elevation: 2 },
  statNumber: { fontSize: 28, fontWeight: '900', color: '#1e293b' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 5, fontWeight: '600' },

  subHeader: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, marginLeft: 5 },
  divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 20 },

  clusterCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#8b5cf6' },
  clusterHeader: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  probabilityText: { color: '#6d28d9', fontWeight: 'bold', marginBottom: 4 },
  aiText: { color: '#0ea5e9', fontWeight: 'bold' },

  roleLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 5 },
  studentName: { fontSize: 15, color: '#334155', fontWeight: '500', marginLeft: 5, marginBottom: 3 },

  flagBtn: { marginTop: 20, backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  flagBtnText: { color: '#dc2626', textAlign: 'center', fontWeight: 'bold' },

  cleanCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  cleanName: { fontSize: 16, fontWeight: 'bold', color: '#065f46' },
  cleanRoll: { fontSize: 13, color: '#047857' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  reasonInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#334155' },
  cancelBtn: { padding: 12, borderRadius: 8, backgroundColor: '#e2e8f0', flex: 0.45, alignItems: 'center' },
  confirmFlagBtn: { padding: 12, borderRadius: 8, backgroundColor: '#ef4444', flex: 0.45, alignItems: 'center' },
});