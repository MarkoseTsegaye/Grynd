import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme/colors';

type ColorToken = keyof typeof colors;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: IconName;
  size: number;
  color: ColorToken;
}

export function Icon({ name, size, color }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={colors[color]} />;
}
