// src/components/admin/SecurityAuditTool.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { IconName } from '@/theme/icons';
import { performSecurityAudit, SecurityAuditResults, SecurityIssue } from '@/utils/securityAudit';
import { useAuth } from '@/contexts/AuthContext';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
};

/**
 * Security Audit Tool Component for Admin Users
 * This component allows admins to run security audits and see potential issues
 */
const SecurityAuditTool: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SecurityAuditResults | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);

  // Ensure only admins can use this tool
  if (!user || !hasPermission('admin')) {
    return (
      <Card style={styles.unauthorizedCard}>
        <Icon name="lock" size="large" color={CASINO_COLORS.error} />
        <Text style={styles.unauthorizedText}>
          אין לך הרשאה לגשת לכלי הביקורת האבטחתית.
        </Text>
      </Card>
    );
  }

  const runSecurityAudit = async () => {
    try {
      setLoading(true);
      
      // Confirm audit
      Alert.alert(
        "הפעלת ביקורת אבטחה",
        "סריקת אבטחה עשויה להשפיע על ביצועי המערכת. האם להמשיך?",
        [
          { text: "ביטול", style: "cancel" },
          { 
            text: "המשך", 
            onPress: async () => {
              try {
                const auditResults = await performSecurityAudit();
                setResults(auditResults);
              } catch (error) {
                console.error('Error running security audit:', error);
                Alert.alert(
                  "שגיאה",
                  "אירעה שגיאה במהלך ביצוע הביקורת. נסה שוב מאוחר יותר."
                );
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in security audit:', error);
      setLoading(false);
    }
  };

  const toggleIssueExpansion = (issueId: string) => {
    setExpandedIssues(prev => 
      prev.includes(issueId) 
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return CASINO_COLORS.error;
      case 'medium':
        return CASINO_COLORS.warning;
      case 'low':
        return CASINO_COLORS.gold;
      default:
        return CASINO_COLORS.text;
    }
  };

  const getSeverityIcon = (severity: string): IconName => {
    switch (severity) {
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'alert';
      case 'low':
        return 'information';
      default:
        return 'help-circle';
    }
  };

  const getStatusIcon = (status: boolean): IconName => {
    return status ? 'check-circle' : 'close-circle';
  };

  const getStatusColor = (status: boolean): string => {
    return status ? CASINO_COLORS.success : CASINO_COLORS.error;
  };

  return (
    <View style={styles.container}>
      <Card style={styles.headerCard}>
        <Text variant="h4" style={styles.headerTitle}>
          כלי ביקורת אבטחה
        </Text>
        <Text style={styles.headerSubtitle}>
          כלי זה יבדוק את קונפיגורציית האבטחה של האפליקציה ויזהה בעיות אפשריות.
        </Text>
      </Card>

      <Button
        title={loading ? "מבצע ביקורת..." : "הפעל ביקורת אבטחה"}
        onPress={runSecurityAudit}
        style={styles.auditButton}
        loading={loading}
        disabled={loading}
      />

      {results && (
        <ScrollView style={styles.resultsContainer}>
          <Text variant="h4" style={styles.sectionTitle}>
            סטטוס אבטחה
          </Text>

          {/* Status Cards */}
          <View style={styles.statusCardsContainer}>
            <Card style={styles.statusCard}>
              <Icon 
                name={getStatusIcon(results.firebaseConfigSecure)} 
                size="medium" 
                color={getStatusColor(results.firebaseConfigSecure)} 
              />
              <Text style={styles.statusTitle}>Firebase</Text>
            </Card>

            <Card style={styles.statusCard}>
              <Icon 
                name={getStatusIcon(results.authImplementationSecure)} 
                size="medium" 
                color={getStatusColor(results.authImplementationSecure)} 
              />
              <Text style={styles.statusTitle}>אימות</Text>
            </Card>

            <Card style={styles.statusCard}>
              <Icon 
                name={getStatusIcon(results.sessionHandlingSecure)} 
                size="medium" 
                color={getStatusColor(results.sessionHandlingSecure)} 
              />
              <Text style={styles.statusTitle}>סשנים</Text>
            </Card>

            <Card style={styles.statusCard}>
              <Icon 
                name={getStatusIcon(results.dataAccessControlsSecure)} 
                size="medium" 
                color={getStatusColor(results.dataAccessControlsSecure)} 
              />
              <Text style={styles.statusTitle}>הרשאות</Text>
            </Card>
          </View>

          {/* Issues List */}
          {results.issues.length > 0 && (
            <>
              <Text variant="h4" style={styles.sectionTitle}>
                בעיות שזוהו ({results.issues.length})
              </Text>
              
              {results.issues.map((issue, index) => (
                <Card key={`issue-${index}`} style={styles.issueCard}>
                  <TouchableOpacity
                    style={styles.issueTitleRow}
                    onPress={() => toggleIssueExpansion(`issue-${index}`)}
                  >
                    <Icon 
                      name={getSeverityIcon(issue.severity)} 
                      size="small" 
                      color={getSeverityColor(issue.severity)} 
                    />
                    <Text style={[
                      styles.issueTitle,
                      { color: getSeverityColor(issue.severity) }
                    ]}>
                      {issue.description}
                    </Text>
                    <Icon 
                      name={expandedIssues.includes(`issue-${index}`) ? 'chevron-up' : 'chevron-down'} 
                      size="small" 
                      color={CASINO_COLORS.gold} 
                    />
                  </TouchableOpacity>
                  
                  {expandedIssues.includes(`issue-${index}`) && (
                    <View style={styles.issueDetails}>
                      <Text style={styles.severityLabel}>
                        חומרה: {translateSeverity(issue.severity)}
                      </Text>
                      <Text style={styles.recommendationTitle}>המלצות:</Text>
                      <Text style={styles.recommendationText}>
                        {issue.recommendation}
                      </Text>
                    </View>
                  )}
                </Card>
              ))}
            </>
          )}

          {/* No Issues Found */}
          {results.issues.length === 0 && (
            <Card style={styles.noIssuesCard}>
              <Icon name="shield-check" size="large" color={CASINO_COLORS.success} />
              <Text style={styles.noIssuesText}>
                לא נמצאו בעיות אבטחה! המערכת מוגדרת כראוי.
              </Text>
            </Card>
          )}

          {/* Timestamp */}
          <Text style={styles.timestampText}>
            ביקורת בוצעה בתאריך: {new Date().toLocaleString('he-IL')}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

// Helper function to translate severity to Hebrew
function translateSeverity(severity: string): string {
  switch (severity) {
    case 'high':
      return 'גבוהה';
    case 'medium':
      return 'בינונית';
    case 'low':
      return 'נמוכה';
    default:
      return severity;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    backgroundColor: CASINO_COLORS.surface,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: CASINO_COLORS.text,
    opacity: 0.8,
    textAlign: 'center',
  },
  auditButton: {
    backgroundColor: CASINO_COLORS.primary,
    marginBottom: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  resultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    marginBottom: 16,
    textAlign: 'right',
  },
  statusCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: CASINO_COLORS.surface,
    width: '48%',
    marginBottom: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  statusTitle: {
    color: CASINO_COLORS.text,
    marginTop: 8,
    fontSize: 16,
  },
  issueCard: {
    backgroundColor: CASINO_COLORS.surface,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  issueTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issueTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 16,
    textAlign: 'right',
  },
  issueDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
  },
  severityLabel: {
    color: CASINO_COLORS.text,
    marginBottom: 8,
    fontSize: 14,
  },
  recommendationTitle: {
    color: CASINO_COLORS.gold,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  recommendationText: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  noIssuesCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.success,
  },
  noIssuesText: {
    color: CASINO_COLORS.success,
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  timestampText: {
    color: CASINO_COLORS.text,
    opacity: 0.6,
    marginTop: 8,
    marginBottom: 24,
    fontSize: 12,
    textAlign: 'center',
  },
  unauthorizedCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.error,
  },
  unauthorizedText: {
    color: CASINO_COLORS.error,
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SecurityAuditTool;