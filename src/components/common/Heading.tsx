import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Text } from './Text';

type HeadingVariant = 'h1' | 'h2' | 'h3' | 'h4';

interface HeadingProps {
  level?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  style?: StyleProp<TextStyle>;
}

export function Heading({
  level = 1,
  children,
  ...props
}: HeadingProps) {
  const variant: HeadingVariant = `h${level}` as HeadingVariant;
  
  return (
    <Text
      variant={variant}
      {...props}
      children={children}
    >
      {children}
    </Text>
  );
}