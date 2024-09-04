import React, { useEffect, useState } from 'react';
import { Button, Modal, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const TooltipPopin = ({onClose}) => {
  const [currentToolTip, setCurrentToolTip] = useState("");

  const data = ["Un spectrohéliographe est un instrument astronomique spécialement conçu pour observer le Soleil à une longueur d'onde précise. Il permet de capturer des images du Soleil en lumière monochromatique, généralement émise par des éléments spécifiques tels que l'hydrogène, l’helium, le calcium etc.. Le spectrohéliographe disperse la lumière du Soleil en un spectre à l'aide d'un réseau de diffraction puis il balaie ensuite le disque solaire, capturant des images d’une longueur d'onde. Les images obtenues sont recomposées pour former une image complète du Soleil, montrant des détails spécifiques à la longueur d'onde sélectionnée.",
    "La raie de l'hydrogène alpha (Hα), à 656,3 nm, révèle des détails cruciaux de la chromosphère du Soleil. Elle montre des protubérances solaires et des filaments, qui sont des structures de plasma éjectées de la surface, des taches solaires, qui sont des zones de forte activité magnétique, et des éruptions solaires, des explosions intenses de radiation.",
    "Les raies dans le spectre du Soleil ont été découvertes par le physicien allemand Joseph von Fraunhofer en 1814. En observant le spectre de la lumière solaire à l'aide d'un prisme, Fraunhofer remarqua de nombreuses lignes sombres, aujourd'hui connues sous le nom de \"raies de Fraunhofer\". Ces raies correspondent à des longueurs d'onde spécifiques où la lumière est absorbée par des éléments présents dans l'atmosphère solaire et terrestre."
  ];

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * data.length);
    console.log(randomIndex)
    setCurrentToolTip(data[randomIndex]);
  }, []); 

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={true}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 20, marginLeft:150,  marginRight:150, borderRadius: 10 }}>
            <Text className="font-bold mb-2 uppercase">Le saviez vous ?</Text>
            <Text className="text-xs mb-4">{currentToolTip}</Text>
            <TouchableOpacity
              style={{ position: 'absolute', top: 10, right: 10 }}
              onPress={onClose}
            >
              <MaterialIcons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

     
    </View>
  );
}

export default TooltipPopin;