// src/components/common/Dialog.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button, ButtonProps } from './Button';
import { Text } from './Text';

interface DialogProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'danger';
  children?: React.ReactNode;
  /** אם true – הכפתורים המוגדרים כברירת מחדל לא יוצגו */
  hideDefaultButtons?: boolean;
  /** הגדרות מותאמות אישית לכפתור האישור */
  confirmButtonProps?: Partial<ButtonProps>;
  /** הגדרות מותאמות אישית לכפתור הביטול */
  cancelButtonProps?: Partial<ButtonProps>;
}

export function Dialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'default',
  children,
  hideDefaultButtons = false,
  confirmButtonProps,
  cancelButtonProps,
}: DialogProps) {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
    >
      <View style={styles.container}>
        {message && (
          <Text variant="bodyNormal" style={styles.message}>
            {message}
          </Text>
        )}
        {children}
        {!hideDefaultButtons && (
          <View style={[styles.buttons, children && styles.buttonsWithContent]}>
            {cancelText && (
              <Button
                title={cancelText}
                variant="ghost"
                onPress={onCancel}
                style={[styles.button, cancelButtonProps?.style]}
                {...cancelButtonProps}
              />
            )}
            {confirmText && (
              <Button
                title={confirmText}
                variant={type === 'danger' ? 'secondary' : 'primary'}
                onPress={onConfirm}
                style={[styles.button, confirmButtonProps?.style]}
                {...confirmButtonProps}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  buttonsWithContent: {
    marginTop: 24,
  },
  button: {
    minWidth: 120,
  },
});
