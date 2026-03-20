import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router'; // 🟢 Use Expo Router hooks!

export default function CourseEvaluationReportScreen() {

	// 🟢 Parse the params from the URL string
	const params = useLocalSearchParams();
	const results = params.results ? JSON.parse(params.results as string) : [];
	const courseName = params.courseName as string;
	// The data passed from your course screen after the API finishes
	// 🟢 Initialize navigation
	const navigation = useNavigation<any>();

	// Calculate high-level analytics
	const totalAssignments = results.length;
	const evaluatedCount = results.filter((r: any) => r.status === 'Evaluated').length;
	const skippedCount = results.filter((r: any) => r.status.includes('Skipped')).length;
	const totalClusters = results.reduce((acc: number, curr: any) => acc + (curr.clusters_found || 0), 0);

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Course Analytics</Text>
				<Text style={styles.headerSub}>{courseName || 'Course-Wide Evaluation'}</Text>
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent}>

				{/* ─── SUMMARY DASHBOARD ─── */}
				<View style={styles.summaryRow}>
					<View style={[styles.statCard, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
						<Text style={[styles.statNumber, { color: '#0369a1' }]}>{evaluatedCount}</Text>
						<Text style={[styles.statLabel, { color: '#0284c7' }]}>Evaluated</Text>
					</View>
					<View style={[styles.statCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
						<Text style={[styles.statNumber, { color: '#dc2626' }]}>{totalClusters}</Text>
						<Text style={[styles.statLabel, { color: '#ef4444' }]}>Total Clusters</Text>
					</View>
					<View style={[styles.statCard, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
						<Text style={[styles.statNumber, { color: '#475569' }]}>{skippedCount}</Text>
						<Text style={[styles.statLabel, { color: '#64748b' }]}>Skipped</Text>
					</View>
				</View>

				<Text style={styles.sectionTitle}>Detailed Breakdown</Text>

				{/* ─── ASSIGNMENT CARDS ─── */}
				{results.map((item: any, index: number) => {
					const isEvaluated = item.status === 'Evaluated';
					const hasClusters = item.clusters_found > 0;

					return (
						// 🟢 FIX: Changed View to TouchableOpacity and added routing!
						<TouchableOpacity
							key={index}
							style={styles.assignmentCard}
							activeOpacity={0.7}
							onPress={() => {
                                if (isEvaluated) {
                                    // 🟢 FIX: Use pure Expo Router push with the exact pathname
                                    router.push({
                                        pathname: '/EvaluationReport',
                                        params: { assignmentId: item.assignment_id }
                                    });
                                }
                            }}
						>
							<View style={styles.cardHeader}>
								<Text style={styles.assignmentTitle}>{item.assignment}</Text>

								{/* Dynamic Status Badge */}
								<View style={[styles.badge, { backgroundColor: isEvaluated ? '#dcfce7' : '#f1f5f9' }]}>
									<Text style={[styles.badgeText, { color: isEvaluated ? '#15803d' : '#64748b' }]}>
										{item.status}
									</Text>
								</View>
							</View>

							{/* Visual Threat Indicator */}
							{isEvaluated && (
								<View style={styles.clusterRow}>
									<Text style={styles.clusterText}>
										{hasClusters ? '⚠️ Plagiarism Detected' : '✅ Clean'}
									</Text>
									<Text style={[styles.clusterCount, { color: hasClusters ? '#ef4444' : '#10b981' }]}>
										{item.clusters_found} {item.clusters_found === 1 ? 'Cluster' : 'Clusters'}
									</Text>
								</View>
							)}

							{/* Mini visual bar chart representing clusters */}
							{isEvaluated && hasClusters && (
								<View style={styles.barChartContainer}>
									<View style={[styles.barChartFill, { width: `${Math.min((item.clusters_found / 5) * 100, 100)}%` }]} />
								</View>
							)}
						</TouchableOpacity>
					);
				})}

			</ScrollView>

			{/* Bottom Action */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
                    <Text style={styles.doneBtnText}>Back to Course</Text>
                </TouchableOpacity>
            </View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f4f6f8' },
	header: { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
	headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
	headerSub: { fontSize: 16, color: '#64748b', marginTop: 4 },

	scrollContent: { padding: 15, paddingBottom: 40 },

	summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
	statCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, elevation: 1 },
	statNumber: { fontSize: 28, fontWeight: '900' },
	statLabel: { fontSize: 12, fontWeight: '700', marginTop: 5, textTransform: 'uppercase' },

	sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, marginLeft: 5 },

	assignmentCard: { backgroundColor: '#fff', padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
	cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
	assignmentTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 10 },
	badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
	badgeText: { fontSize: 12, fontWeight: 'bold' },

	clusterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 },
	clusterText: { fontSize: 14, fontWeight: '600', color: '#334155' },
	clusterCount: { fontSize: 16, fontWeight: '900' },

	barChartContainer: { height: 6, backgroundColor: '#fee2e2', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
	barChartFill: { height: '100%', backgroundColor: '#ef4444' },

	footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
	doneBtn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 8, alignItems: 'center' },
	doneBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});