import { getKeyHashAndroid, initializeKakaoSDK } from '@react-native-kakao/core';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {login, logout, unlink} from '@react-native-kakao/user';

export default function App() {
  useEffect(() => {
    initializeKakaoSDK('50bd8f2b2fe7234f97dab6d209339b61');
  })
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <Button title={'로그인'} onPress={() => {
        login().then(console.log).catch(console.error)
      }}/>
      <Button title={'로그아웃'} onPress={() => {
        logout().then(console.log).catch(console.error)
      }}/>
      <Button title={'회원탈퇴'} onPress={() => {
        unlink().then(console.log).catch(console.error)
      }}/>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
